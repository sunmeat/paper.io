import js from '@eslint/js';

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        Audio: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        CustomEvent: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        structuredClone: 'readonly',
        Uint8Array: 'readonly',
        Uint32Array: 'readonly',
        Int32Array: 'readonly',
        Float32Array: 'readonly',
        Float64Array: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^version$', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['**/*.jsx'],
    rules: {
      'no-unused-vars': 'off'
    }
  }
];
