import axios from "axios";

export interface PinterestPublishOptions {
  boardId?: string;
  link?: string;
  title?: string;
}

export async function publishToPinterest(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  options?: PinterestPublishOptions
): Promise<{ id: string; url: string }> {
  try {
    if (!mediaUrl) {
      throw new Error("Pinterest requires an image URL");
    }
    
    if (!options?.boardId) {
      throw new Error("Pinterest requires a board ID in options.boardId");
    }
    
    const endpoint = "https://api.pinterest.com/v5/pins";
    const pinData = {
      board_id: options.boardId,
      title: options.title || caption.substring(0, 100),
      description: caption.substring(0, 500),
      link: options.link,
      media_source: {
        source_type: "image_url",
        url: mediaUrl,
      },
    };
    
    const response = await axios.post(endpoint, pinData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    
    const pinId = response.data.id;
    
    return {
      id: pinId,
      url: `https://www.pinterest.com/pin/${pinId}`,
    };
  } catch (error: any) {
    throw new Error(`Pinterest publish error: ${error.response?.data?.message || error.message}`);
  }
}
