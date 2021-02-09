let atom1 = {
    label: '1',
    parent: '1',
    type: '1',
    q: '-0.1474',
    x: 1.0,
    y: 1.0,
    z: 0.0
}

let atom2 = {
    label: '2',
    parent: '1',
    type: '2',
    q: '-0.1476',
    x: -0.395,
    y: 1.0,
    z: 0.0

}

let atom3 = {
    label: '3',
    parent: '1',
    type: '3',
    q: '-0.1474',
    x: -1.091,
    y: 1.0,
    z: 1.20854    
}





export function get_atoms() {
    
    let atoms = [atom1, atom2, atom3];
    return atoms

}


export function get_universe() {
    let universe = {
        xlo: '-2.1779',
        xhi: '47.8221',
        ylo: '0.9988',
        yhi: '50.9988',
        zlo: '-0.9416',
        zhi: '49.0584'
    }
    return universe;
}