import * as esbuild from 'esbuild';
import { createServer } from 'http';
import { createReadStream, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Development server configuration
const clients = [];
const port = 3000;
const testDir = './tests';
const distDir = './dist';

// Start esbuild service
const context = await esbuild.context({
  entryPoints: ['tests/index.ts'],
  bundle: true,
  outdir: distDir,  // Output directly to dist directory
  outbase: './tests', // This is important! It flattens the output directory structure
  sourcemap: true,
  format: 'esm',
  target: ['es2020'],
  loader: {
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.svg': 'dataurl',
    '.gif': 'dataurl',
  },
  plugins: [
    {
      name: 'live-reload',
      setup(build) {
        build.onEnd(() => {
          for (const res of clients) {
            res.write('data: update\n\n');
          }
        });
      }
    }
  ]
});

context.serve({ servedir: '.' }, {}).then(() => {

  const server = createServer((req, res) => {
    const { url } = req;

    if (url === '/esbuild') {
      // Set headers for SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Send initial message
      res.write('data: connected\n\n');

      // Add client to list
      clients.push(res);

      // Handle client disconnect
      req.on('close', () => {
        clients.splice(clients.indexOf(res), 1);
      });
      return;
    }

    // Handle root request
    if (url === '/') {
      const filePath = resolve(__dirname, testDir, 'index.html');
      serveFile(filePath, res);
      return;
    }

    // For JS files in dist directory
    if (url.startsWith('/dist/') && (url.endsWith('.js') || url.endsWith('.map'))) {
      const filePath = resolve(__dirname, url.slice(1));

      if (existsSync(filePath)) {
        serveFile(filePath, res);
      } else {
        // Try without the "tests" subdirectory
        const altPath = url.replace('/dist/tests/', '/dist/');
        const altFilePath = resolve(__dirname, altPath.slice(1));
        console.log(`Trying alternative path: ${altFilePath}`);

        if (existsSync(altFilePath)) {
          serveFile(altFilePath, res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
      return;
    }

    // Handle other static files
    const filePath = resolve(__dirname, url.slice(1));
    serveFile(filePath, res);
  });

  // Start development server
  server.listen(port, () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });


});


// Helper function to serve a file
function serveFile(filePath, res) {
  if (existsSync(filePath)) {
    const extension = filePath.split('.').pop().toLowerCase();
    const contentType = getContentType(extension);

    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } else {
    console.log(`File not found: ${filePath}`);
    res.writeHead(404);
    res.end('Not Found');
  }
}

// Helper function to get content type
function getContentType(extension) {
  const contentTypes = {
    'html': 'text/html',
    'js': 'application/javascript',
    'css': 'text/css',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'map': 'application/json'
  };

  return contentTypes[extension] || 'text/plain';
}


// Start the esbuild service in watch mode
await context.watch();
console.log('Build complete. Watching for changes...');

// Handle server close
process.on('SIGINT', () => {
  context.dispose();
  server.close();
  process.exit(0);
});