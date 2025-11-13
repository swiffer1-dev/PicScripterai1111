import axios from "axios";
import FormData from "form-data";

export interface TwitterPublishOptions {
  replySettings?: "everyone" | "mentionedUsers" | "following";
}

async function uploadMediaToTwitter(
  accessToken: string,
  mediaUrl: string
): Promise<string> {
  console.log("[X MEDIA] Starting media upload process");
  console.log("[X MEDIA] Original media URL (first 100 chars):", mediaUrl.substring(0, 100));
  
  try {
    // Step 1: Download the image from the media URL
    console.log("[X MEDIA] Step 1: Downloading image from signed URL...");
    const imageResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });
    
    console.log("[X MEDIA] Download response status:", imageResponse.status);
    console.log("[X MEDIA] Download content-type:", imageResponse.headers["content-type"]);
    console.log("[X MEDIA] Download content-length:", imageResponse.headers["content-length"]);
    
    const imageBuffer = Buffer.from(imageResponse.data);
    const bufferSize = imageBuffer.length;
    
    console.log("[X MEDIA] Buffer size (bytes):", bufferSize);
    
    if (bufferSize === 0) {
      throw new Error("Downloaded image is empty (0 bytes)");
    }
    
    if (bufferSize > 5 * 1024 * 1024) {
      console.warn("[X MEDIA] Warning: Image is larger than 5MB, may be rejected by Twitter");
    }
    
    const contentType = imageResponse.headers["content-type"] || "image/jpeg";
    
    // Determine file extension from content type
    const ext = contentType.split("/")[1] || "jpg";
    const filename = `image.${ext}`;
    
    console.log("[X MEDIA] Prepared file:", { filename, contentType, size: bufferSize });

    // Step 2: Upload to Twitter v2 media/upload endpoint (OAuth 2.0 compatible)
    console.log("[X MEDIA] Step 2: Uploading to Twitter media endpoint...");
    const uploadEndpoint = "https://api.twitter.com/2/media/upload";
    
    const formData = new FormData();
    formData.append("media", imageBuffer, {
      filename,
      contentType,
    });
    formData.append("media_category", "tweet_image");

    const uploadResponse = await axios.post(uploadEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 60000,
    });

    console.log("[X MEDIA] Twitter upload response status:", uploadResponse.status);
    console.log("[X MEDIA] Twitter upload response data:", JSON.stringify(uploadResponse.data, null, 2));

    // Twitter v2 API returns: { data: { id: "media_id" } }
    const mediaId = uploadResponse.data.data?.id || uploadResponse.data.media_id_string;
    if (!mediaId) {
      console.error("[X MEDIA] ERROR: No media ID in response:", uploadResponse.data);
      throw new Error("No media ID returned from Twitter");
    }
    
    console.log("[X MEDIA] ✓ SUCCESS - Media uploaded with ID:", mediaId);
    return mediaId;
  } catch (error: any) {
    console.error("[X MEDIA] ✗ FAILED - Error during media upload");
    console.error("[X MEDIA] Error type:", error.constructor.name);
    console.error("[X MEDIA] Error message:", error.message);
    
    if (error.response) {
      console.error("[X MEDIA] HTTP Status:", error.response.status);
      console.error("[X MEDIA] Response headers:", error.response.headers);
      console.error("[X MEDIA] Response data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("[X MEDIA] No response received from:", error.config?.url);
      console.error("[X MEDIA] Request timeout or network error");
    }
    
    throw new Error(`Failed to upload media to Twitter: ${error.response?.data?.errors?.[0]?.message || error.response?.data?.detail || error.message}`);
  }
}

export async function publishToTwitter(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  options?: TwitterPublishOptions
): Promise<{ id: string; url: string }> {
  console.log("[X PUBLISH] Starting tweet creation");
  console.log("[X PUBLISH] Caption length:", caption.length);
  console.log("[X PUBLISH] Has media URL:", !!mediaUrl);
  
  try {
    const endpoint = "https://api.twitter.com/2/tweets";
    const tweetData: any = {
      text: caption.substring(0, 280), // Twitter character limit
    };
    
    if (options?.replySettings) {
      tweetData.reply_settings = options.replySettings;
    }
    
    // Upload media if provided
    if (mediaUrl) {
      console.log("[X PUBLISH] Media URL provided, starting upload...");
      try {
        const mediaId = await uploadMediaToTwitter(accessToken, mediaUrl);
        tweetData.media = {
          media_ids: [mediaId],
        };
        console.log(`[X PUBLISH] ✓ Media attached to tweet with ID: ${mediaId}`);
      } catch (mediaError: any) {
        console.error("[X PUBLISH] ✗ Media upload failed, posting text only:", mediaError.message);
        // Continue with text-only tweet if media upload fails
      }
    } else {
      console.log("[X PUBLISH] No media URL provided, creating text-only tweet");
    }
    
    console.log("[X PUBLISH] Tweet payload (without auth):", JSON.stringify(tweetData, null, 2));
    
    const response = await axios.post(endpoint, tweetData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    
    console.log("[X PUBLISH] Tweet creation response status:", response.status);
    console.log("[X PUBLISH] Tweet creation response:", JSON.stringify(response.data, null, 2));
    
    const tweetId = response.data.data.id;
    const userId = response.data.data.author_id || "user";
    
    const result = {
      id: tweetId,
      url: `https://twitter.com/${userId}/status/${tweetId}`,
    };
    
    console.log("[X PUBLISH] ✓ Tweet published successfully:", result.url);
    
    return result;
  } catch (error: any) {
    console.error("[X PUBLISH] ✗ Tweet creation failed");
    console.error("[X PUBLISH] Error:", error.response?.data || error.message);
    throw new Error(`Twitter publish error: ${error.response?.data?.detail || error.message}`);
  }
}
