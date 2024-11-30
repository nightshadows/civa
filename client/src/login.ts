import { RestApiClient } from './api-client';

const api = new RestApiClient();
const nameInput = document.getElementById('nameInput') as HTMLInputElement;
const errorMessage = document.getElementById('errorMessage')!;
const registerButton = document.getElementById('registerButton')!;

registerButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    
    // Basic validation
    if (name.length < 3) {
        showError('Name must be at least 3 characters long');
        return;
    }
    
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
        showError('Name can only contain letters, numbers, underscores and hyphens');
        return;
    }
    
    try {
        const response = await api.register(name);
        if (response.success) {
            window.location.href = '/';
        } else {
            showError(response.error || 'Registration failed');
        }
    } catch (error) {
        showError('Failed to register. Please try again.');
        console.error('Registration error:', error);
    }
});

function showError(message: string) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Clear error when typing
nameInput.addEventListener('input', () => {
    errorMessage.style.display = 'none';
}); 