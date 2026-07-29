module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'renderer/vendor/',
    'renderer/fonts/',
    'coverage/'
  ],
  overrides: [
    {
      files: ['main.js', 'preload.js', 'src/**/*.js', 'scripts/**/*.js', 'test/**/*.js'],
      plugins: ['security'],
      extends: ['plugin:security/recommended-legacy'],
      parserOptions: { ecmaVersion: 2022 },
      rules: {
        'security/detect-object-injection': 'warn',
        'security/detect-non-literal-fs-filename': 'warn',
        'security/detect-eval-with-expression': 'error',
        'security/detect-unsafe-regex': 'error',
        'security/detect-child-process': 'warn',
        'no-eval': 'error',
        'no-new-func': 'error'
      }
    },
    {
      files: ['renderer/**/*.js'],
      env: { browser: true, node: false },
      plugins: ['security'],
      extends: ['plugin:security/recommended-legacy'],
      parserOptions: { ecmaVersion: 2022 },
      rules: {
        'security/detect-object-injection': 'warn',
        'security/detect-eval-with-expression': 'error',
        'security/detect-unsafe-regex': 'error',
        'no-eval': 'error',
        'no-new-func': 'error'
      }
    }
  ]
};
