import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Controller('health')
export class HealthController {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  @Get()
  async health() {
    try {
      await this.users.query('SELECT 1');
      return { status: 'ok', db: 'up', ts: new Date().toISOString() };
    } catch {
      return { status: 'degraded', db: 'down' };
    }
  }
}
