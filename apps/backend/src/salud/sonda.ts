/** Token de la sonda. La implementación con TypeORM vive aparte para que este archivo no la importe. */
export class SondaPostgres {
  comprobar(): Promise<boolean> {
    return Promise.reject(new Error('sonda_no_configurada'));
  }
}
