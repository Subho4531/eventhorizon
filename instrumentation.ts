/**
 * Next.js instrumentation hook
 * Runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamically import the server initialization logic
    // This ensures it only runs in the Node.js runtime (not Edge)
    const { initializeServer } = await import('./lib/server-init');
    await initializeServer();
  }
}
