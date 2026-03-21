const sharp = require("sharp");
sharp("assets/images/greyadz-logo-v2.png")
  .resize(450, 450, { fit: "contain", background: { r:0, g:0, b:0, alpha:0 } })
  .extend({
    top: 287,
    bottom: 287,
    left: 287,
    right: 287,
    background: { r:0, g:0, b:0, alpha:0 }
  })
  .toFile("assets/images/adaptive-icon.png")
  .then(() => console.log("Done adaptive"));
  
sharp("assets/images/greyadz-logo-v2.png")
  .resize(700, 700, { fit: "contain", background: { r:0, g:0, b:0, alpha:0 } })
  .extend({
    top: 162,
    bottom: 162,
    left: 162,
    right: 162,
    background: { r:0, g:0, b:0, alpha:0 }
  })
  .toFile("assets/images/icon.png")
  .then(() => console.log("Done icon"));

sharp("assets/images/greyadz-logo-v2.png")
  .resize(800, 800, { fit: "contain", background: { r:0, g:0, b:0, alpha:0 } })
  .toFile("assets/images/splash.png")
  .then(() => console.log("Done splash"));

