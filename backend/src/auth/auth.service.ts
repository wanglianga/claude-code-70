import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.users.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const payload = { sub: user.id, username: user.username, role: user.role, name: user.name };
    const token = await this.jwt.signAsync(payload);
    return {
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, phone: user.phone },
    };
  }

  async profile(userId: number) {
    const u = await this.users.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    return { id: u.id, username: u.username, name: u.name, role: u.role, phone: u.phone };
  }
}
