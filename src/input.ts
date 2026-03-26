export const InputState = {
    Up: "up",
    Down: "down",
} as const;

export type InputState = typeof InputState[keyof typeof InputState];

export const MouseButton = {
    Left: 0,
    Middle: 1,
    Right: 2,
    Four: 3,
    Five: 4,
} as const;

export type MouseButton = typeof MouseButton[keyof typeof MouseButton];

export type Mouse = {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    buttons: InputState[];
    pointer_locked: boolean;
};

export const Key = {
    Number0:  0, Number1:  1, Number2:  2, Number3:  3, Number4:  4,
    Number5:  5, Number6:  6, Number7:  7, Number8:  8, Number9:  9,

    A: 10, B: 11, C: 12, D: 13, E: 14,
    F: 15, G: 16, H: 17, I: 18, J: 19,
    K: 20, L: 21, M: 22, N: 23, O: 24,
    P: 25, Q: 26, R: 27, S: 28, T: 29,
    U: 30, V: 31, W: 32, X: 33, Y: 34, 
    Z: 35,

    Control: 36, Shift: 37, Space: 38, Escape: 39,
} as const;

export type Key = typeof Key[keyof typeof Key];

export type Keyboard = {
    keys: InputState[];
};

export let mouse: Mouse = {} as Mouse;
export let keyboard: Keyboard = {} as Keyboard;

function event_handler_mouse_move(event: MouseEvent) {
    mouse.deltaX = event.movementX;
    mouse.deltaY = event.movementY;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
}

function event_handler_mouse_down(event: MouseEvent) {
    if (event.button < 0 || event.button >= mouse.buttons.length) {
        console.warn(`mouse button ${event.button} is not recognized`);
        return;
    }

    mouse.buttons[event.button] = InputState.Down;
}

function event_handler_mouse_up(event: MouseEvent) {
    if (event.button < 0 || event.button >= mouse.buttons.length) {
        console.warn(`mouse button ${event.button} is not recognized`);
        return;
    }

    mouse.buttons[event.button] = InputState.Up;
}

function event_handler_keys(event: KeyboardEvent) {
    let state: InputState;
    switch (event.type) {
        case "keydown": state = InputState.Down; break;
        case "keyup": state = InputState.Up; break;
        default: console.warn(`event type ${event.type} is not recognized`); return;
    }

    switch (event.key.toLocaleLowerCase()) {
        case "0": keyboard.keys[Key.Number0] = state; break;
        case "1": keyboard.keys[Key.Number1] = state; break;
        case "2": keyboard.keys[Key.Number2] = state; break;
        case "3": keyboard.keys[Key.Number3] = state; break;
        case "4": keyboard.keys[Key.Number4] = state; break;
        case "5": keyboard.keys[Key.Number5] = state; break;
        case "6": keyboard.keys[Key.Number6] = state; break;
        case "7": keyboard.keys[Key.Number7] = state; break;
        case "8": keyboard.keys[Key.Number8] = state; break;
        case "9": keyboard.keys[Key.Number9] = state; break;
        
        case "a": keyboard.keys[Key.A] = state; break;
        case "b": keyboard.keys[Key.B] = state; break;
        case "c": keyboard.keys[Key.C] = state; break;
        case "d": keyboard.keys[Key.D] = state; break;
        case "e": keyboard.keys[Key.E] = state; break;
        case "f": keyboard.keys[Key.F] = state; break;
        case "g": keyboard.keys[Key.G] = state; break;
        case "h": keyboard.keys[Key.H] = state; break;
        case "i": keyboard.keys[Key.I] = state; break;
        case "j": keyboard.keys[Key.J] = state; break;
        case "k": keyboard.keys[Key.K] = state; break;
        case "l": keyboard.keys[Key.L] = state; break;
        case "m": keyboard.keys[Key.M] = state; break;
        case "n": keyboard.keys[Key.N] = state; break;
        case "o": keyboard.keys[Key.O] = state; break;
        case "p": keyboard.keys[Key.P] = state; break;
        case "q": keyboard.keys[Key.Q] = state; break;
        case "r": keyboard.keys[Key.R] = state; break;
        case "s": keyboard.keys[Key.S] = state; break;
        case "t": keyboard.keys[Key.T] = state; break;
        case "u": keyboard.keys[Key.U] = state; break;
        case "v": keyboard.keys[Key.V] = state; break;
        case "w": keyboard.keys[Key.W] = state; break;
        case "x": keyboard.keys[Key.X] = state; break;
        case "y": keyboard.keys[Key.Y] = state; break;
        case "z": keyboard.keys[Key.Z] = state; break;

        case "control": keyboard.keys[Key.Control]  = state; break;
        case "shift":   keyboard.keys[Key.Shift]    = state; break;
        case " ":       keyboard.keys[Key.Space]    = state; break;
        case "escape":  keyboard.keys[Key.Escape]   = state; break;
        
        default: console.warn(`key ${event.key} is not recognized`); break;
    }
}

export function input_init(canvas: HTMLCanvasElement) {
    mouse = {
        x: 0,
        y: 0,
        deltaX: 0,
        deltaY: 0,
        buttons: Array(Object.keys(MouseButton).length).fill(InputState.Up),
        pointer_locked: false,
    };

    canvas.addEventListener("mousemove", event_handler_mouse_move);
    canvas.addEventListener("mousedown", event_handler_mouse_down);
    canvas.addEventListener("mouseup", event_handler_mouse_up);
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    // canvas.addEventListener("click", () => canvas.requestPointerLock());

    keyboard = {
        keys: Array(Object.keys(Key).length).fill(InputState.Up),
    };

    window.addEventListener("keydown", event_handler_keys);
    window.addEventListener("keyup", event_handler_keys);
}

export function input_poll() {
    mouse.pointer_locked = document.pointerLockElement != null;
}

export function input_reset() {
    mouse.deltaX = 0;
    mouse.deltaY = 0;
}
