
abstract class Stage {

    protected _name: string;

    constructor(name: string) {
        this._name = name;
    }

    public get name(): string {
        return this._name;
    }

    public process = () => {
        
    }
}

class Pipeline {

    private _pipelines: Pipeline[] = [];

    constructor() {

    }

    public add = (pipeline: Pipeline) => {
        this._pipelines.push(pipeline);
    };

}


export { Stage, Pipeline };