const fs = require('fs');
let authContent = fs.readFileSync('auth.js', 'utf8');

const newFunc = `
  // ==========================================
  // SUGGEST EDIT
  // ==========================================
  async function submitSuggestion(doctorId, message) {
    if (!supabaseClient) throw new Error('Supabase not configured');
    if (!currentUser) throw new Error('Please sign in to suggest edits.');
    
    const { error } = await supabaseClient
      .from('suggestions')
      .insert({
        doctor_id: doctorId,
        user_id: currentUser.id,
        message: message,
        status: 'pending'
      });
      
    if (error) throw new Error(error.message);
  }
`;

authContent = authContent.replace('window.AuthManager = {', newFunc + '\n  window.AuthManager = {\n    submitSuggestion,');

fs.writeFileSync('auth.js', authContent);
console.log('Added submitSuggestion to auth.js');
