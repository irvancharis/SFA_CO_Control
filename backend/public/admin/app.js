const versionTableBody = document.getElementById('versionTableBody');
const versionModal = document.getElementById('versionModal');
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');
const versionForm = document.getElementById('versionForm');

// Base API URL
const API_URL = '/api';

// Load versions on start
document.addEventListener('DOMContentLoaded', fetchVersions);

openModalBtn.onclick = () => versionModal.classList.add('active');
closeModalBtn.onclick = () => versionModal.classList.remove('active');

window.onclick = (event) => {
    if (event.target == versionModal) {
        versionModal.classList.remove('active');
    }
}

async function fetchVersions() {
    try {
        const response = await fetch(`${API_URL}/admin/apk-versions`);
        const data = await response.json();
        
        versionTableBody.innerHTML = '';
        data.forEach(v => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${v.version_name}</strong></td>
                <td><code style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">${v.version_code}</code></td>
                <td>
                    <span class="status-pill ${v.is_force_update ? 'status-force' : 'status-optional'}">
                        ${v.is_force_update ? 'Force' : 'Optional'}
                    </span>
                </td>
                <td style="color:var(--text-muted)">${new Date(v.created_at).toLocaleString()}</td>
                <td>
                    <div class="action-btns">
                        <a href="${v.download_url}" target="_blank" class="btn-icon" title="Download">
                            <i class="fas fa-download"></i>
                        </a>
                        <button onclick="deleteVersion(${v.id})" class="btn-icon btn-delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            versionTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching versions:', error);
    }
}

versionForm.onsubmit = async (e) => {
    e.preventDefault();
    
    // Show loading state
    const submitBtn = versionForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    const formData = new FormData();
    formData.append('version_name', document.getElementById('versionName').value);
    formData.append('version_code', document.getElementById('versionCode').value);
    formData.append('release_notes', document.getElementById('releaseNotes').value);
    formData.append('is_force_update', document.getElementById('isForceUpdate').checked ? 1 : 0);
    
    const fileInput = document.getElementById('apkFile');
    if (fileInput.files.length > 0) {
        formData.append('apk_file', fileInput.files[0]);
    }

    try {
        const response = await fetch(`${API_URL}/admin/apk-versions`, {
            method: 'POST',
            body: formData // No need for Content-Type header with FormData
        });

        if (response.ok) {
            versionModal.classList.remove('active');
            versionForm.reset();
            fetchVersions();
        } else {
            const errData = await response.json();
            alert('Failed to save version: ' + (errData.error || 'Server error'));
        }
    } catch (error) {
        console.error('Error saving version:', error);
        alert('Upload failed. Connection error.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
};

async function deleteVersion(id) {
    if (!confirm('Are you sure you want to delete this version?')) return;

    try {
        const response = await fetch(`${API_URL}/admin/apk-versions/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            fetchVersions();
        } else {
            alert('Failed to delete version');
        }
    } catch (error) {
        console.error('Error deleting version:', error);
    }
}
