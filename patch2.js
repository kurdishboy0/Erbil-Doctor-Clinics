const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const modalHtml = `
  <!-- Suggest Edit Modal -->
  <div class="modal-overlay" id="suggestModal" style="display:none;">
    <div class="modal auth-modal">
      <button class="modal-close" id="suggestModalClose" aria-label="Close">✕</button>
      <div class="auth-modal-body">
        <div class="auth-header">
          <h2>Suggest an Edit</h2>
          <p>Help us keep <strong id="suggestDoctorName">this doctor's</strong> profile up to date.</p>
        </div>
        <form id="suggestEditForm" class="auth-form">
          <div class="auth-error" id="suggestError" style="display:none; color:red; margin-bottom:10px; font-size:0.9rem;"></div>
          <div class="auth-success" id="suggestSuccess" style="display:none; color:green; margin-bottom:10px; font-size:0.9rem;"></div>
          <input type="hidden" id="suggestDoctorId" value="">
          <div class="form-group">
            <label for="suggestMessage">What needs to be changed?</label>
            <textarea id="suggestMessage" placeholder="e.g., The phone number has changed to 0750..., or the clinic moved to 100m street." required></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="suggestSubmitBtn">Submit Suggestion</button>
        </form>
      </div>
    </div>
  </div>
`;

if (!html.includes('id="suggestModal"')) {
  html = html.replace('<!-- Footer -->', modalHtml + '\n  <!-- Footer -->');
  fs.writeFileSync('index.html', html);
  console.log('Added modal to index.html');
}
