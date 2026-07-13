declare module "draco3d" {
  interface DracoModule {
    createDecoderModule(): Promise<unknown>;
    createEncoderModule(): Promise<unknown>;
  }
  const draco3d: DracoModule;
  export = draco3d;
}
