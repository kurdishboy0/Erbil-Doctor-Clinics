const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

// 1. Map button in createDoctorCard
const search1 = "${doctor.clinic ? `<div class=\"detail-item\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/></svg>\n            <span>${escapeHtml(doctor.clinic)}</span>\n          </div>` : ''}";

const replace1 = "${doctor.clinic ? `<div class=\"detail-item\" style=\"flex-wrap: wrap;\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/></svg>\n            <span>${escapeHtml(doctor.clinic)}</span>\n            <a href=\"https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doctor.clinic + ' ' + doctor.area + ' Erbil')}\" target=\"_blank\" class=\"map-btn\" style=\"margin-left:auto; margin-top:0; padding:2px 8px; font-size:0.75rem;\" onclick=\"event.stopPropagation()\">📍 Map</a>\n          </div>` : ''}";

content = content.replace(search1, replace1);

// 2. Map button in openDoctorModal
const search2 = "${doctor.clinic ? `<div class=\"info-row\">\n                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/></svg>\n                <div class=\"info-row-content\"><div class=\"info-row-label\">Clinic / Pharmacy</div><div class=\"info-row-value\">${escapeHtml(doctor.clinic)}</div></div>\n              </div>` : ''}";

const replace2 = "${doctor.clinic ? `<div class=\"info-row\">\n                <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/></svg>\n                <div class=\"info-row-content\">\n                  <div class=\"info-row-label\">Clinic / Pharmacy</div>\n                  <div class=\"info-row-value\">${escapeHtml(doctor.clinic)}</div>\n                  <a href=\"https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doctor.clinic + ' ' + doctor.area + ' Erbil')}\" target=\"_blank\" class=\"map-btn\">📍 View on Map</a>\n                </div>\n              </div>` : ''}";

content = content.replace(search2, replace2);

// 3. Suggest Edit Button at the end of the modal
const search3 = "</div>\n        </div>`;\n  \n      // Render ratings";
const replace3 = "</div>\n        </div>\n        <button class=\"suggest-edit-btn\" onclick=\"openSuggestModal(${doctor.id}, '` + escapeHtml(doctor.name).replace(/'/g, \"\\\\'\") + `')\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"16\" height=\"16\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg>\n          Suggest an Edit (Wrong phone? Moved clinic?)\n        </button>\n        `;\n  \n      // Render ratings";

content = content.replace(search3, replace3);

fs.writeFileSync('app.js', content);
console.log('App patched successfully.');
