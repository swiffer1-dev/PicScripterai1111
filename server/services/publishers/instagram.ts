import axios from "axios";

export interface InstagramPublishOptions {
  igUserId?: string;
}

export async function publishToInstagram(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  mediaType?: string,
  options?: InstagramPublishOptions
): Promise<{ id: string; url: string }> {
  try {
    const igUserId = options?.igUserId || "me";
    
    if (!mediaUrl) {
      throw new Error("Instagram requires media (image or video)");
    }
    
    // Step 1: Create media container
    const containerEndpoint = `https://graph.facebook.com/v18.0/${igUserId}/media`;
    const containerData: any = {
      caption,
      access_token: accessToken,
    };
    
    if (mediaType === "video") {
      containerData.media_type = "VIDEO";
      containerData.video_url = mediaUrl;
    } else {
      containerData.image_url = mediaUrl;
    }
    
    const containerResponse = await axios.post(containerEndpoint, containerData);
    const creationId = containerResponse.data.id;
    
    // Step 2: Wait for container to be ready (for videos especially)
    // In production, this should be done via polling or webhook
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Publish the container
    const publishEndpoint = `https://graph.facebook.com/v18.0/${igUserId}/media_publish`;
    const publishResponse = await axios.post(publishEndpoint, {
      creation_id: creationId,
      access_token: accessToken,
    });
    
    const mediaId = publishResponse.data.id;
    
    return {
      id: mediaId,
      url: `https://www.instagram.com/p/${mediaId}`,
    };
  } catch (error: any) {
    throw new Error(`Instagram publish error: ${error.response?.data?.error?.message || error.message}`);
  }
}
