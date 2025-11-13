import axios from "axios";
import FormData from "form-data";

export interface TwitterPublishOptions {
  replySettings?: "everyone" | "mentionedUsers" | "following";
}

async function uploadMediaToTwitter(
  accessToken: string,
  mediaUrl: string
): Promise<string> {
  try {
    // Step 1: Download the image from the media URL
    const imageResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers["content-type"] || "image/jpeg";
    
    // Determine file extension from content type
    const ext = contentType.split("/")[1] || "jpg";
    const filename = `image.${ext}`;

    // Step 2: Upload to Twitter v2 media/upload endpoint (OAuth 2.0 compatible)
    const uploadEndpoint = "https://api.twitter.com/2/media/upload";
    
    const formData = new FormData();
    formData.append("media", imageBuffer, {
      filename,
      contentType,
    });

    const uploadResponse = await axios.post(uploadEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Twitter v2 API returns: { data: { id: "media_id" } }
    const mediaId = uploadResponse.data.data?.id || uploadResponse.data.media_id_string;
    if (!mediaId) {
      throw new Error("No media ID returned from Twitter");
    }
    
    return mediaId;
  } catch (error: any) {
    console.error("Twitter media upload error:", error.response?.data || error.message);
    throw new Error(`Failed to upload media to Twitter: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
}

export async function publishToTwitter(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  options?: TwitterPublishOptions
): Promise<{ id: string; url: string }> {
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
      try {
        const mediaId = await uploadMediaToTwitter(accessToken, mediaUrl);
        tweetData.media = {
          media_ids: [mediaId],
        };
        console.log(`Successfully uploaded media to Twitter: ${mediaId}`);
      } catch (mediaError: any) {
        console.error("Media upload failed, posting text only:", mediaError.message);
        // Continue with text-only tweet if media upload fails
      }
    }
    
    const response = await axios.post(endpoint, tweetData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    
    const tweetId = response.data.data.id;
    const userId = response.data.data.author_id || "user";
    
    return {
      id: tweetId,
      url: `https://twitter.com/${userId}/status/${tweetId}`,
    };
  } catch (error: any) {
    throw new Error(`Twitter publish error: ${error.response?.data?.detail || error.message}`);
  }
}
