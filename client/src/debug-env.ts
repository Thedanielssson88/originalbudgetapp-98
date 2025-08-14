// Debug file to check environment variables
console.log('=== Environment Debug START ===');
console.log('import.meta.env:', import.meta.env);
console.log('VITE_STACK_PROJECT_ID:', import.meta.env.VITE_STACK_PROJECT_ID);
console.log('VITE_STACK_PUBLISHABLE_CLIENT_KEY:', import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY);
console.log('VITE_STACK_PROJECT_ID type:', typeof import.meta.env.VITE_STACK_PROJECT_ID);
console.log('VITE_STACK_PUBLISHABLE_CLIENT_KEY type:', typeof import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY);
console.log('=== Environment Debug END ===');

// Also add to window for easy inspection
if (typeof window !== 'undefined') {
  (window as any).DEBUG_ENV = {
    VITE_STACK_PROJECT_ID: import.meta.env.VITE_STACK_PROJECT_ID,
    VITE_STACK_PUBLISHABLE_CLIENT_KEY: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
    allEnv: import.meta.env
  };
}

export {};