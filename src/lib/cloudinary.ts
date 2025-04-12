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

export async function uploadToCloudinary(base64data: string, folder = "chat") {
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
      resource_type: "auto", // Auto-detect resource type (image, video, raw)
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
}
