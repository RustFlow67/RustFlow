// For an offline webpack build only. Feed next/font/google the genuine, bundled
// OFL Unbounded variable files. Next still scopes, hashes and preloads each subset.
const path = require("node:path");
const ranges = {
  cyrillic: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
  latin:
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};
module.exports = {
  "https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800;900&display=swap": Object.entries(ranges)
    .map(
      ([subset, range]) => `/* ${subset} */
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 700 900;
  font-display: swap;
  src: url(${path.resolve(__dirname, `../../public/fonts/unbounded-${subset}-wght-normal.woff2`)}) format('woff2');
  unicode-range: ${range};
}`,
    )
    .join("\n"),
};
