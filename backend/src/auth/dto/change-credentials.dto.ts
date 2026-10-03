import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangeUsernameDto {
  @IsString()
  @MinLength(3, { message: 'Login kamida 3 belgi bo\'lsin' })
  @MaxLength(32, { message: 'Login ko\'pi bilan 32 belgi bo\'lsin' })
  @Matches(/^[a-zA-Z0-9_.]+$/, { message: 'Login faqat lotin harflari, raqam, _ va . dan iborat bo\'lsin' })
  username: string;

  /** Tasdiq: ochiq qolgan kompyuterdan akkauntni egallab olishning oldini oladi */
  @IsString()
  @MinLength(1, { message: 'Joriy parolni kiriting' })
  @MaxLength(200)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Joriy parolni kiriting' })
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Yangi parol kamida 8 belgi bo\'lsin' })
  @MaxLength(200)
  newPassword: string;
}
