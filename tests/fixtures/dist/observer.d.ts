export type Observer = {
    start: () => void;
    stop: () => void;
    update: () => void;
};
export default function createObserver({ threshold, delay, containers, callback, filter }: {
    threshold: number;
    delay: number;
    containers: string[];
    callback: (el: HTMLAnchorElement) => void;
    filter: (el: HTMLAnchorElement) => boolean;
}): Observer;