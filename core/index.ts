import {Molvis} from './src/app';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const molvis = new Molvis(canvas);
molvis.render();

const create_frame = (step:number, translate: number[], rotate: number[]) => {
    const xyz = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
    // translate and rotate
    for (let i = 0; i < xyz.length; i++) {
        for (let j = 0; j < 3; j++) {
            xyz[i][j] += translate[j];
        }
    }
    for (let i = 0; i < xyz.length; i++) {
        const [x, y, z] = xyz[i];
        xyz[i][0] = x * rotate[0] - y * rotate[1];
        xyz[i][1] = x * rotate[1] + y * rotate[0];
    }
    
    const names = ['C', 'H1', 'H2', 'H3'];
    const bond_ids = [[0, 1], [0, 2], [0, 3]];
    const bond_type = [1, 1, 1];
    
    // 创建 bonds 和 atoms 的 props Map
    const atomProps = new Map<string, any[]>();
    const bondProps = new Map<string, any[]>([['bond_type', bond_type]]);
    
    molvis.add_frame(step, { names, xyz, props: atomProps }, { bond_ids, props: bondProps });
}

// create 5 frames randomly
for (let i = 0; i < 5; i++) {
    const step = i;
    const translate = [i * 2, 0, 0];
    const rotate = [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)];
    create_frame(step, translate, rotate);
}
molvis.draw_frame(0);
