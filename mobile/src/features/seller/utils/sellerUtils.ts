import { supabase } from '../../../services/supabase';
import { ENV } from '../../../config/env';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_IMAGE_BYTES = 800 * 1024;

export type PreparedImage = {
  uri: string;
  size: number;
};

/** Resize and progressively compress an image before it enters upload state. */
export async function prepareImageForUpload(
  localUri: string,
  reportedSourceSize?: number | null
): Promise<PreparedImage> {
  const sourceSize = reportedSourceSize ?? new File(localUri).size;
  if (sourceSize != null && sourceSize > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Image must be 10 MB or smaller.');
  }

  const qualitySteps = [0.72, 0.58, 0.45];
  let latestUri = localUri;
  let latestSize = sourceSize ?? 0;

  for (const compress of qualitySteps) {
    const result = await manipulateAsync(
      localUri,
      [{ resize: { width: 1600 } }],
      { compress, format: SaveFormat.JPEG }
    );
    latestUri = result.uri;
    latestSize = new File(result.uri).size ?? 0;

    if (latestSize > 0 && latestSize <= MAX_UPLOAD_IMAGE_BYTES) {
      return { uri: latestUri, size: latestSize };
    }
  }

  throw new Error(
    `Compressed image is still larger than ${Math.round(MAX_UPLOAD_IMAGE_BYTES / 1024)} KB. Choose a smaller image.`
  );
}

export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

export const FOOTWEAR_KEYWORDS = ['shoe', 'footwear', 'sneaker', 'boot', 'sandal', 'heel', 'slipper'];
export const CLOTHING_KEYWORDS = [
  'clothing',
  'shirt',
  'pant',
  'dress',
  'fashion',
  'jean',
  'top',
  'wear',
  'hoodie',
  'jacket',
  'short',
];

export function getAvailableSizes(categoryName: string): string[] | null {
  if (!categoryName) return CLOTHING_SIZES;

  const lowerCategory = categoryName.toLowerCase();

  if (FOOTWEAR_KEYWORDS.some((keyword) => lowerCategory.includes(keyword))) {
    return SHOE_SIZES;
  }

  if (CLOTHING_KEYWORDS.some((keyword) => lowerCategory.includes(keyword))) {
    return CLOTHING_SIZES;
  }

  return CLOTHING_SIZES;
}

/**
 * Calculates distance in kilometers between two coordinates using the Haversine formula.
 */
export function calculateDistance(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | undefined {
  if (
    lat1 === undefined ||
    lat1 === null ||
    lon1 === undefined ||
    lon1 === null ||
    lat2 === undefined ||
    lat2 === null ||
    lon2 === undefined ||
    lon2 === null
  ) {
    return undefined;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Uploads a local image URI to a Supabase Storage bucket and returns the public URL (or storage path).
 */
export async function uploadImageToStorage(
  localUri: string,
  bucket: string,
  storagePath: string,
  returnPublicUrl = true
): Promise<string> {
  const response = await fetch(localUri);

  // Supabase Storage expects an ArrayBuffer in React Native. Blob uploads can
  // fail on native even though the same upload works in the browser. Local
  // file:// responses may also report 404 despite containing the file body,
  // so validate the bytes instead of relying on response.ok.
  const imageData = await response.arrayBuffer();

  if (imageData.byteLength === 0) {
    throw new Error('The selected image is empty or could not be read.');
  }
  if (imageData.byteLength > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error(
      `Image exceeds the ${Math.round(MAX_UPLOAD_IMAGE_BYTES / 1024)} KB upload limit.`
    );
  }

  const extension = storagePath.split('.').pop()?.toLowerCase();
  const contentType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error('Image upload requires an active login. Please sign in again.');
  }

  // Attach the JWT explicitly. On React Native, a restored AsyncStorage session
  // is not always applied to the Storage client's first request.
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const uploadResponse = await fetch(
    `${ENV.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: ENV.SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: imageData,
    }
  );

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.json().catch(() => null);
    throw new Error(
      `Image upload failed: ${errorBody?.message || errorBody?.error || uploadResponse.statusText}`
    );
  }

  if (returnPublicUrl) {
    return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
  }

  return storagePath;
}
