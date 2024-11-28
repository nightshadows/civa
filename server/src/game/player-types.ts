export enum PlayerType {
    HUMAN = 'human',
    AI = 'ai'
}

export interface PlayerConfig {
    id: string;
    type: PlayerType;
}