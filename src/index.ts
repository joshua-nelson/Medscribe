import app from './app';
import { validateEnvironment } from './utils/validateEnv';

// SEC-015: Validate environment variables before starting server
validateEnvironment();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
