/**
 * ÚNICO ponto que escolhe a implementação dos serviços.
 * Para ligar a API REST (FastAPI): troque a linha abaixo por `createApiServices()`.
 * A UI só importa `services` daqui — nunca `services/mock/*`.
 */
import type { Services } from "./contracts";
import { getAllowedGoogleDomains } from "@/lib/rules";
import { createMockServices } from "./mock";

export const services: Services = createMockServices({ allowedGoogleDomains: getAllowedGoogleDomains() });

export type * from "./contracts";
