import axios from "axios";

export interface FacebookPublishOptions {
  pageId?: string;
}

export async function publishToFacebook(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  options?: FacebookPublishOptions
): Promise<{ id: string; url: string }> {
  const pageId = options?.pageId || "me";
  
  try {
    let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    const data: any = {
      message: caption,
      access_token: accessToken,
    };
    
    if (mediaUrl) {
      endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
      data.url = mediaUrl;
      data.caption = caption;
    }
    
    const response = await axios.post(endpoint, data);
    
    return {
      id: response.data.id,
      url: `https://www.facebook.com/${response.data.id}`,
    };
  } catch (error: any) {
    throw new Error(`Facebook publish error: ${error.response?.data?.error?.message || error.message}`);
  }
}
