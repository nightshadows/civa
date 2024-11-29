export const getOrCreatePlayerId = (): string => {
    const storedId = localStorage.getItem('playerId');
    if (storedId) return storedId;
    
    const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    localStorage.setItem('playerId', newId);
    return newId;
};

export const generateGameId = (): string => {
    return 'game-' + Math.random().toString(36).substring(2, 9);
}; 