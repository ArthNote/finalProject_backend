import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log(
  "Cloudinary configured with cloud name:",
  process.env.CLOUDINARY_CLOUD_NAME
);

export const uploadToCloudinary = {
  upload: async function (
    base64data: string,
    folder = "chat",
    type = "auto" as "image" | "video" | "raw" | "auto"
  ) {
    try {
      console.log(`Starting upload to Cloudinary folder: ${folder}`);

      if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        console.error("Missing Cloudinary configuration");
        throw new Error("Cloudinary configuration missing");
      }

      // Handle both data URLs and raw base64
      const uploadData = base64data.startsWith("data:")
        ? base64data
        : `data:application/octet-stream;base64,${base64data}`;

      const result = await cloudinary.uploader.upload(uploadData, {
        folder: folder,
        resource_type: type, // Auto-detect resource type (image, video, raw)
        timeout: 60000, // 60 seconds for large files
      });

      console.log("Upload successful:", {
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        url: result.secure_url.substring(0, 40) + "...",
      });

      return result;
    } catch (error: any) {
      console.error("Cloudinary upload error:", error.message);
      throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
    }
  },

  deleteFile: async function (publicId: string) {
    try {
      console.log(`Deleting file from Cloudinary: ${publicId}`);
      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== "ok") {
        throw new Error("Failed to delete file from Cloudinary");
      }

      return result;
    } catch (error: any) {
      console.error("Cloudinary delete error:", error.message);
      throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
    }
  },
};
