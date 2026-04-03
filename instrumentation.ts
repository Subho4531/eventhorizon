/**
 * Next.js instrumentation hook
 * Runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import and initialize server on Node.js runtime only
    const { initializeServer } = await import('./lib/server-init')
    initializeServer()
  }
}
