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
  if (!options?.pageId) {
    throw new Error("Facebook Page ID is required. Please reconnect your Facebook account.");
  }
  
  const pageId = options.pageId;
  
  try {
    let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    const truncatedCaption = caption.substring(0, 63206); // Facebook limit
    const data: any = {
      message: truncatedCaption,
      access_token: accessToken,
    };
    
    if (mediaUrl) {
      endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
      data.url = mediaUrl;
      data.caption = truncatedCaption;
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
