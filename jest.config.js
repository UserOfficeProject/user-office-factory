module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/src/pdf/pdfTableOfContents/*.js',
  ],
};
