import { IsString, IsBoolean, IsArray, IsIn, IsOptional } from 'class-validator';

export class CreateAutomationDto {
  @IsString()
  name: string;

  @IsIn(['any', 'keyword'])
  triggerType: 'any' | 'keyword';

  @IsArray()
  keywords: string[];

  @IsBoolean()
  replyEnabled: boolean;

  @IsArray()
  replyTemplates: string[];

  @IsBoolean()
  dmEnabled: boolean;

  @IsArray()
  dmTemplates: string[];

  @IsOptional() @IsArray()
  dmButtons?: { title: string; url: string }[];

  @IsOptional() @IsBoolean()
  followCheckEnabled?: boolean;

  @IsOptional() @IsString()
  followAskMessage?: string;

  @IsOptional() @IsString()
  followAskButton?: string;

  @IsOptional() @IsString()
  followFailMessage?: string;

  @IsOptional() @IsString()
  followFailButton?: string;

  @IsIn(['all', 'specific'])
  postScope: 'all' | 'specific';

  @IsArray()
  postIds: string[];

  @IsArray()
  postData: { id: string; caption?: string; thumbnail?: string }[];

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
