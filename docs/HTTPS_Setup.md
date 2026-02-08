# HTTPS Setup for Microphone Access

## Problem Solved

**Error**: "Microphone access is not supported in this browser."

**Root Cause**: Modern browsers require HTTPS for `navigator.mediaDevices.getUserMedia()` (microphone/camera access). MedScribe was configured with HTTP-only, causing the browser to block microphone permissions.

**Solution**: Added HTTPS support with self-signed SSL certificates for development.

---

## What Was Changed

### 1. Generated Self-Signed SSL Certificate

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/nginx-selfsigned.key \
  -out nginx/ssl/nginx-selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=MedScribe/CN=localhost"
```

**Files created:**

- `nginx/ssl/nginx-selfsigned.crt` (certificate, 1 year validity)
- `nginx/ssl/nginx-selfsigned.key` (private key)

### 2. Updated Nginx Configuration

**File**: `nginx/default.conf`

**Changes**:

- Added HTTP→HTTPS redirect (port 80 → 443)
- Added HTTPS listener on port 443 with TLS 1.2/1.3
- Mounted SSL certificate and key
- Updated `X-Forwarded-Proto` header to `https`

### 3. Updated Docker Compose

**File**: `docker-compose.yml`

**Changes**:

- Exposed port `443:443` for HTTPS
- Mounted `./nginx/ssl:/etc/nginx/ssl:ro` (read-only SSL certificates)

---

## How to Access MedScribe

### Development (Local Machine)

**✅ HTTPS with self-signed certificate (recommended):**

```
https://localhost
```

**Browser Warning**: You'll see "Your connection is not private" - this is normal for self-signed certificates.

**To bypass:**

- Chrome: Click "Advanced" → "Proceed to localhost (unsafe)"
- Firefox: Click "Advanced" → "Accept the Risk and Continue"
- Safari: Click "Show Details" → "visit this website"

**✅ HTTP on localhost (alternative):**

```
http://localhost
```

Works because `localhost` is a [secure context exception](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts#localhost_is_a_secure_context).

### Local Network Access (Different Machine)

**❌ Does NOT work:**

```
http://192.168.x.x  # Microphone blocked - insecure context
```

**✅ Works with HTTPS:**

```
https://192.168.x.x  # Requires accepting self-signed certificate warning
```

---

## Browser Requirements for getUserMedia

| Context               | Microphone Access | Notes                                  |
| --------------------- | ----------------- | -------------------------------------- |
| `https://example.com` | ✅ Yes            | Production standard                    |
| `http://localhost`    | ✅ Yes            | Secure context exception               |
| `http://127.0.0.1`    | ✅ Yes            | Secure context exception               |
| `http://*.localhost`  | ✅ Yes            | Secure context exception (Firefox 84+) |
| `http://192.168.x.x`  | ❌ **NO**         | **Requires HTTPS**                     |
| `http://10.x.x.x`     | ❌ **NO**         | **Requires HTTPS**                     |
| `http://example.com`  | ❌ **NO**         | Insecure context                       |

**Error when HTTPS required but not present:**

```
navigator.mediaDevices is undefined
TypeError: Cannot read property 'getUserMedia' of undefined
```

---

## Production Deployment

### Option 1: Self-Signed Certificate (On-Premise)

**Pros:**

- ✅ No external dependencies
- ✅ Full control over certificate
- ✅ Works for on-premise HIPAA compliance

**Cons:**

- ⚠️ Browser warnings on first access (users must accept)
- ⚠️ Need to manually renew yearly

**Generate production certificate** (2048-bit key, 1 year validity):

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/medscribe.key \
  -out nginx/ssl/medscribe.crt \
  -subj "/C=US/ST=State/L=City/O=Your-Hospital/CN=medscribe.yourhospital.local"
```

**Update nginx/default.conf:**

```nginx
ssl_certificate /etc/nginx/ssl/medscribe.crt;
ssl_certificate_key /etc/nginx/ssl/medscribe.key;
```

### Option 2: Internal Certificate Authority (Enterprise)

**Best for hospitals with existing PKI:**

1. **Request certificate from IT/PKI team** for `medscribe.hospital.internal`
2. **Install CA certificate** on all workstations (eliminates browser warnings)
3. **Deploy signed certificate** to nginx

**Update nginx/default.conf:**

```nginx
ssl_certificate /etc/nginx/ssl/medscribe-signed.crt;
ssl_certificate_key /etc/nginx/ssl/medscribe.key;
ssl_trusted_certificate /etc/nginx/ssl/ca-bundle.crt;  # Optional: CA chain
```

### Option 3: Let's Encrypt (Internet-Accessible)

**⚠️ Only if MedScribe is accessible from the internet**

**Not recommended for on-premise HIPAA deployments** (external dependency)

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate (requires DNS/HTTP verification)
certbot --nginx -d medscribe.example.com

# Auto-renewal (cron job)
0 0 1 * * certbot renew --quiet
```

---

## SSL/TLS Security Configuration

### Current Settings (Development)

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

### Recommended Production Settings

**For HIPAA compliance, enhance to:**

```nginx
server {
  listen 443 ssl http2;

  ssl_certificate /etc/nginx/ssl/medscribe.crt;
  ssl_certificate_key /etc/nginx/ssl/medscribe.key;

  # TLS 1.3 only (most secure)
  ssl_protocols TLSv1.3;

  # Strong cipher suites (HIPAA-compliant)
  ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256';
  ssl_prefer_server_ciphers on;

  # OCSP stapling (performance + privacy)
  ssl_stapling on;
  ssl_stapling_verify on;

  # Increase session security
  ssl_session_timeout 1d;
  ssl_session_cache shared:SSL:50m;
  ssl_session_tickets off;

  # HSTS (force HTTPS for 1 year)
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  # Security headers
  add_header X-Frame-Options DENY always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-XSS-Protection "1; mode=block" always;

  # ... rest of config
}
```

---

## Troubleshooting

### "Your connection is not private" Warning

**Cause**: Self-signed certificate not trusted by browser

**Solution**: Click "Advanced" → "Proceed to localhost" (safe for development)

**Production fix**: Use certificate from internal CA installed on workstations

### "This site can't provide a secure connection"

**Cause**: Nginx SSL configuration error

**Debug:**

```bash
# Check nginx logs
docker compose logs nginx --tail 50

# Verify SSL files exist
ls -la nginx/ssl/

# Test nginx config
docker compose exec nginx nginx -t
```

### "ERR_SSL_PROTOCOL_ERROR"

**Cause**: Port 443 not exposed or SSL not configured

**Fix:**

```bash
# Verify port 443 is exposed
docker compose ps nginx
# Should show: 0.0.0.0:443->443/tcp

# Restart nginx
docker compose restart nginx
```

### Microphone Still Not Working on HTTPS

**Possible causes:**

1. **Browser doesn't support getUserMedia** (very old browsers)
   - Update to Chrome 47+, Firefox 36+, Safari 11+, Edge 79+

2. **User denied microphone permission**
   - Check browser address bar for blocked microphone icon
   - Go to browser settings → Site permissions → Microphone → Allow

3. **No microphone device found**
   - Check system microphone is connected and enabled
   - Test with: `navigator.mediaDevices.enumerateDevices()`

4. **Mixed content (HTTPS page loading HTTP resources)**
   - Check browser console for mixed content warnings
   - Ensure all assets load over HTTPS

---

## Testing Microphone Access

### Browser Console Test

Open browser DevTools (F12) and run:

```javascript
// Check if getUserMedia is available
console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);

// Request microphone access
navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => {
    console.log('✅ Microphone access granted!');
    console.log('Audio tracks:', stream.getAudioTracks());
    stream.getTracks().forEach((track) => track.stop()); // Clean up
  })
  .catch((error) => {
    console.error('❌ Microphone access failed:', error.name, error.message);
  });
```

**Expected output (success):**

```
getUserMedia available: true
✅ Microphone access granted!
Audio tracks: [MediaStreamTrack]
```

**Error output (failure):**

```
getUserMedia available: false
// or
❌ Microphone access failed: NotAllowedError The request is not allowed
// or
❌ Microphone access failed: NotFoundError Requested device not found
```

---

## File Changes Summary

| File                             | Change   | Purpose                              |
| -------------------------------- | -------- | ------------------------------------ |
| `nginx/ssl/nginx-selfsigned.crt` | NEW      | SSL certificate (public)             |
| `nginx/ssl/nginx-selfsigned.key` | NEW      | SSL private key                      |
| `nginx/default.conf`             | MODIFIED | Added HTTPS listener + HTTP redirect |
| `docker-compose.yml`             | MODIFIED | Exposed port 443, mounted SSL volume |

---

## Next Steps for Production

1. **Generate production SSL certificate** (from internal CA or self-signed with longer validity)
2. **Update certificate paths** in nginx config
3. **Install CA certificate** on all workstations (if using internal CA)
4. **Test from multiple devices** on hospital network
5. **Configure hostname** in DNS/hosts file (e.g., `medscribe.hospital.local`)
6. **Enable HSTS and security headers** (see production config above)
7. **Document access instructions** for clinical staff
8. **Set up certificate renewal reminders** (1 year for self-signed)

---

## References

- [MDN: getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html) (TLS 1.3 required)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
