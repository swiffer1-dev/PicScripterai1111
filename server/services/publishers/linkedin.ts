import axios from "axios";

export interface LinkedInPublishOptions {
  visibility?: "PUBLIC" | "CONNECTIONS";
}

export async function publishToLinkedIn(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  options?: LinkedInPublishOptions
): Promise<{ id: string; url: string }> {
  try {
    // Get user profile ID
    const profileResponse = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    const personId = profileResponse.data.sub;
    
    // Create post
    const endpoint = "https://api.linkedin.com/v2/ugcPosts";
    const postData: any = {
      author: `urn:li:person:${personId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: caption.substring(0, 3000), // LinkedIn limit
          },
          shareMediaCategory: mediaUrl ? "IMAGE" : "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": options?.visibility || "PUBLIC",
      },
    };
    
    // Add media if provided
    if (mediaUrl) {
      // Note: LinkedIn requires media to be uploaded first via registerUpload
      // This is a simplified implementation
      postData.specificContent["com.linkedin.ugc.ShareContent"].media = [
        {
          status: "READY",
          originalUrl: mediaUrl,
        },
      ];
    }
    
    const response = await axios.post(endpoint, postData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    
    const postId = response.headers["x-restli-id"] || response.data.id;
    
    return {
      id: postId,
      url: `https://www.linkedin.com/feed/update/${postId}`,
    };
  } catch (error: any) {
    throw new Error(`LinkedIn publish error: ${error.response?.data?.message || error.message}`);
  }
}
