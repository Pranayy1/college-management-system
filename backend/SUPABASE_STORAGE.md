# Fee Payment QR Storage

The fee-payment QR helper uses a private Supabase Storage bucket named `fee-payment-qr`.

Create this bucket manually in the Supabase dashboard before enabling the future course payment destination API. Do not make the bucket public. The backend uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the server to upload objects and create temporary signed URLs.

Add these values to the backend environment without committing real credentials:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

QR objects are stored under `<course_code>/<uuid>.<extension>` inside the bucket. Supported formats are PNG, JPEG, and WebP, with a maximum size of 5 MB.
