import axios from "axios";

export interface TwitterPublishOptions {
  replySettings?: "everyone" | "mentionedUsers" | "following";
}

export async function publishToTwitter(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  options?: TwitterPublishOptions
): Promise<{ id: string; url: string }> {
  try {
    // Note: Twitter API v2 requires elevated access for media uploads
    // This implementation focuses on text-only tweets
    
    const endpoint = "https://api.twitter.com/2/tweets";
    const tweetData: any = {
      text: caption.substring(0, 280), // Twitter character limit
    };
    
    if (options?.replySettings) {
      tweetData.reply_settings = options.replySettings;
    }
    
    // TODO: Implement media upload for paid tier
    if (mediaUrl) {
      console.warn("Media upload requires Twitter API elevated access");
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
