/**
 * ÚNICO ponto que escolhe a implementação dos serviços.
 * Para ligar a API REST (FastAPI): troque a linha abaixo por `createApiServices()`.
 * A UI só importa `services` daqui — nunca `services/mock/*`.
 */
import type { Services } from "./contracts";
import { createMockServices } from "./mock";

export const services: Services = createMockServices();

export type * from "./contracts";
/** Aviso de que o conteúdo do protótipo é fictício (a UI não importa `services/mock/*`). */
export { DEMO_DATA_NOTICE } from "./mock/seed";
