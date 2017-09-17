# EECS Office Hours Queue
A simple, web-based queueing system for office hours. If you'd like to contribute, here's how to get a development environment set up...


###Install virtualbox

https://www.virtualbox.org/wiki/Downloads

###Install vagrant

https://www.vagrantup.com/downloads.html

###Clone the repo to your local machine.

Run "vagrant up" (in the same directory as the Vagrantfile).

Edit your hosts file. Add an entry to map the VM's IP to "queue-dev". The IP should always be the same as here.

192.168.33.11 queue-dev

Use ssh to connect to the VM at "queue-dev". username and password are both "vagrant"

cd to /var/www/public

Run the following:

~~~ bash
$ composer update

$ composer install
~~~

That's it! You can edit the source files in the help_queue directory locally (you don't have to do it on the VM itself!).
Use whatever editor you like. I personally prefer JetBrains WebStorm for an IDE, which you should be able to get for
free as a student.

Access the queue in your web browser at http://queue-dev. (Again, you can use a browser from your local machine, not from the VM.)

If you need to access the mysql database directly, ssh into the virtual machine (see directions above). You can connect to mysql as root with username and password "root".

If login randomly stops working, it might be that the system time on your virtual machine somehow got thrown off.
To fix this, ssh into the VM and follow the answer here: http://askubuntu.com/questions/254826/how-to-force-a-clock-update-using-ntp
I also made an update to the Vagrantfile that should keep this problem from occurring.
