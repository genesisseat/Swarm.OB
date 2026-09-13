import { ProviderConnection, ProviderId } from "./types";

export class ProviderService {
  constructor(private providers: ProviderConnection[] = []) {}

  public registerProvider(provider: ProviderConnection): void {
    this.providers.push(provider);
  }

  public getProviders(): ProviderConnection[] {
    return this.providers;
  }

  public getProviderById(id: ProviderId): ProviderConnection | undefined {
    return this.providers.find((provider) => provider.provider === id);
  }

  public formatProviderLabel(id: ProviderId): string {
    return id.toUpperCase();
  }
}
