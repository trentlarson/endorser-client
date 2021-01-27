import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

@Entity()
export class Contact extends BaseEntity {
  // The ones in @veramo/data-store don't require explicit types but I get ColumnTypeUndefinedError
  @PrimaryColumn('text')
  //@ts-ignore
  did: string

  @Column('text', { nullable: true })
  //@ts-ignore
  name: string
}
