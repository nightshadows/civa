
export const generateGameId = (): string => {
    return 'game-' + Math.random().toString(36).substring(2, 9);
}; 