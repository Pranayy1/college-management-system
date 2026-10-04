# Fee Payment QR Storage

The fee-payment QR helper uses a private Supabase Storage bucket named `fee-payment-qr`.

Create this bucket manually in the Supabase dashboard before enabling the course payment destination API. Do not make the bucket public. The backend uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the server to upload objects and create temporary signed URLs.

Add these values to the backend environment without committing real credentials:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

QR objects are stored under `<course_code>/<uuid>.<extension>` inside the bucket. Supported formats are PNG, JPEG, and WebP, with a maximum size of 5 MB.

## Profile Images and Admin Logo

Create the public `faculty-assets` and `student-assets` buckets in Supabase Storage. Profile image objects are stored under `profiles/<faculty_id>/<uuid>.<extension>` and `profiles/<roll_number>/<uuid>.<extension>`, respectively. Public read access is required because the profile image URLs are returned to the web and mobile clients. Student profile images retain their 2 MB limit and accept JPG/JPEG and PNG. Faculty profile images accept JPG/JPEG, PNG, and WebP; as before, they have no configured upload size limit.

The admin logo continues to use the existing `admin-assets` bucket and the fixed `admin/logo` object. That bucket/object must be publicly readable for public logo URLs to work.

Excel import files are held in memory only while each request is processed and are not stored in Supabase.
