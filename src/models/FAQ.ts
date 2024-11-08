import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/sequelize';
import { User } from './User';

export type TFAQ = {
  id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: object;
  answer_en: object;
  created_at: Date;
  created_by: number | null;
  updated_at: Date;
  updated_by: number | null;
};

export class FAQ extends Model<TFAQ> implements TFAQ {
  public id!: number;
  public maincategory_ko!: string;
  public maincategory_en!: string;
  public subcategory_ko!: string;
  public subcategory_en!: string;
  public question_ko!: string;
  public question_en!: string;
  public answer_ko!: object;
  public answer_en!: object;
  public created_at!: Date;
  public created_by!: number | null;
  public updated_at!: Date;
  public updated_by!: number | null;

  static associate() {
    FAQ.belongsTo(User, {
      foreignKey: 'created_by',
      as: 'creator',
      onDelete: 'SET NULL',
    });
    FAQ.belongsTo(User, {
      foreignKey: 'updated_by',
      as: 'updater',
      onDelete: 'SET NULL',
    });
  }
}

FAQ.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    maincategory_ko: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    maincategory_en: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    subcategory_ko: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    subcategory_en: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    question_ko: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    question_en: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    answer_ko: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    answer_en: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'updated_by',
    },
  },
  {
    sequelize,
    modelName: 'FAQ',
    tableName: 'faqs',
    timestamps: false,
    underscored: true,
  }
);

export default FAQ;
