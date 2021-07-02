
let listeners = [];

function addListener(a) {
    listeners.push(a);
}

function invoke() {
    console.log(`invoking ${listeners.length} listeners`);
    for(let i = 0; i < listeners.length; i++) {
        console.log(`invoked a listener`);
        listeners[i]();
    }
}

module.exports = {
    addListener, invoke
}
