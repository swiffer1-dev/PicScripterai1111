import axios from "axios";

export interface TikTokPublishOptions {
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export async function publishToTikTok(
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  options?: TikTokPublishOptions
): Promise<{ id: string; url: string }> {
  try {
    if (!mediaUrl) {
      throw new Error("TikTok requires a video URL");
    }
    
    // Step 1: Initialize video upload
    const initEndpoint = "https://open.tiktokapis.com/v2/post/publish/video/init/";
    const initResponse = await axios.post(
      initEndpoint,
      {
        post_info: {
          title: caption.substring(0, 150),
          privacy_level: options?.privacyLevel || "PUBLIC_TO_EVERYONE",
          disable_comment: options?.disableComment || false,
          disable_duet: options?.disableDuet || false,
          disable_stitch: options?.disableStitch || false,
        },
        source_info: {
          source: "FILE_URL",
          video_url: mediaUrl,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    const publishId = initResponse.data.data.publish_id;
    
    return {
      id: publishId,
      url: `https://www.tiktok.com/@user/video/${publishId}`,
    };
  } catch (error: any) {
    throw new Error(`TikTok publish error: ${error.response?.data?.error?.message || error.message}`);
  }
}
