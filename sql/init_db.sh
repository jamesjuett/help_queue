mysql -u root < /var/www/sql/init_db.sql
mysql -u root queue < /var/www/sql/init_queue.sql
mysql -u root queue < /var/www/sql/migrate_queue.sql