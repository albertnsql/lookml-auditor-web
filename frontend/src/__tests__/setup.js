// Test setup — runs before every test file
import '@testing-library/jest-dom';

// Polyfill for Blob.text() which is missing in some jsdom environments
if (!Blob.prototype.text) {
  Blob.prototype.text = function() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(this);
    });
  };
}
