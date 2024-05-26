import helloThere from './hello_there';
import joke from './joke';

interface Command {
    data: {
        name: string;
        description: string;
        toJSON: () => object;
    };
    execute: (interaction: any) => Promise<void>;
}

export const commands: { [key: string]: Command } = {
    helloThere,
    joke,
};
